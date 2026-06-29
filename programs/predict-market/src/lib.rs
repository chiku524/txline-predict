use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

mod txline_cpi;
use txline_cpi::{
    invoke_validate_stat, BinaryExpression, Comparison, ProofNode, ScoreStat, ScoresBatchSummary,
    ScoresUpdateStats, StatTerm, TraderPredicate, ValidateStatArgs,
};

declare_id!("47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3");

/// TxLINE oracle programs — CPI targets for validate_stat settlement.
pub const TXLINE_PROGRAM_ID_MAINNET: Pubkey =
    pubkey!("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
pub const TXLINE_PROGRAM_ID_DEVNET: Pubkey =
    pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

fn is_txline_program(id: &Pubkey) -> bool {
    *id == TXLINE_PROGRAM_ID_MAINNET || *id == TXLINE_PROGRAM_ID_DEVNET
}

const MAX_OUTCOMES: usize = 8;

#[program]
pub mod predict_market {
    use super::*;

    /// Create a market escrow vault for a fixture + market type (encoded in fixture_id).
    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: String,
        outcome_count: u8,
        lock_timestamp: i64,
    ) -> Result<()> {
        require!(
            outcome_count >= 2 && outcome_count <= MAX_OUTCOMES as u8,
            PredictError::InvalidOutcomes
        );
        require!(fixture_id.len() <= 64, PredictError::FixtureIdTooLong);

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.vault = ctx.accounts.vault.key();
        market.fixture_id = fixture_id;
        market.outcome_count = outcome_count;
        market.lock_timestamp = lock_timestamp;
        market.status = MarketStatus::Open;
        market.total_deposited = 0;
        market.outcome_pools = [0u64; MAX_OUTCOMES];
        market.winning_outcome = None;
        market.settlement_root = None;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    /// Deposit USDC into an outcome side of the pool and record the position.
    pub fn deposit(
        ctx: Context<Deposit>,
        outcome_index: u8,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, PredictError::InvalidAmount);

        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::Open, PredictError::MarketClosed);
        require!(
            outcome_index < market.outcome_count,
            PredictError::InvalidOutcome
        );
        require!(
            Clock::get()?.unix_timestamp < market.lock_timestamp,
            PredictError::MarketLocked
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        let market = &mut ctx.accounts.market;
        let idx = outcome_index as usize;
        market.outcome_pools[idx] = market.outcome_pools[idx]
            .checked_add(amount)
            .ok_or(PredictError::Overflow)?;
        market.total_deposited = market
            .total_deposited
            .checked_add(amount)
            .ok_or(PredictError::Overflow)?;

        let position = &mut ctx.accounts.position;
        if position.amount == 0 {
            position.market = market.key();
            position.depositor = ctx.accounts.depositor.key();
            position.outcome_index = outcome_index;
            position.claimed = false;
            position.bump = ctx.bumps.position;
        } else {
            require!(
                position.outcome_index == outcome_index,
                PredictError::InvalidOutcome
            );
        }
        position.amount = position
            .amount
            .checked_add(amount)
            .ok_or(PredictError::Overflow)?;

        Ok(())
    }

    /// Settle after TxLINE validate_stat CPI (permissionless keeper).
    pub fn settle_market(
        ctx: Context<SettleMarket>,
        winning_outcome: u8,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        predicate: TraderPredicate,
        stat_a: StatTerm,
        stat_b: Option<StatTerm>,
        op: Option<BinaryExpression>,
        home_score: i32,
        away_score: i32,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::Open, PredictError::MarketClosed);
        require!(
            winning_outcome < market.outcome_count,
            PredictError::InvalidOutcome
        );

        require!(
            is_txline_program(&ctx.accounts.txline_program.key()),
            PredictError::InvalidTxLineProgram
        );

        if !fixture_proof.is_empty() {
            invoke_validate_stat(
                &ctx.accounts.txline_program.to_account_info(),
                &ctx.accounts.daily_scores_merkle_roots.to_account_info(),
                ValidateStatArgs {
                    ts,
                    fixture_summary: fixture_summary.clone(),
                    fixture_proof,
                    main_tree_proof,
                    predicate,
                    stat_a,
                    stat_b,
                    op,
                },
            )?;
        } else {
            // Dev / demo fallback: only market creator may settle without proof.
            require_keys_eq!(
                ctx.accounts.keeper.key(),
                market.authority,
                PredictError::UnauthorizedKeeper
            );
        }

        let expected = derive_winning_outcome(&market.fixture_id, home_score, away_score)?;
        require!(
            winning_outcome == expected,
            PredictError::WinningOutcomeMismatch
        );

        let market = &mut ctx.accounts.market;
        market.status = MarketStatus::Resolved;
        market.winning_outcome = Some(winning_outcome);
        market.settlement_root = Some(fixture_summary.events_sub_tree_root);
        Ok(())
    }

    /// Claim parimutuel winnings after verified settlement.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(
            market.status == MarketStatus::Resolved,
            PredictError::MarketNotResolved
        );
        let winning = market
            .winning_outcome
            .ok_or(PredictError::MarketNotResolved)?;

        let position = &mut ctx.accounts.position;
        require!(!position.claimed, PredictError::AlreadyClaimed);
        require!(
            position.outcome_index == winning,
            PredictError::NotWinner
        );
        require!(position.amount > 0, PredictError::InvalidAmount);

        let winning_pool = market.outcome_pools[winning as usize];
        require!(winning_pool > 0, PredictError::EmptyWinningPool);

        let payout = (position.amount as u128)
            .checked_mul(market.total_deposited as u128)
            .ok_or(PredictError::Overflow)?
            .checked_div(winning_pool as u128)
            .ok_or(PredictError::Overflow)? as u64;

        require!(payout > 0, PredictError::InvalidAmount);

        let market_fixture_id = market.fixture_id.clone();
        let market_bump = market.bump;
        let market_key = market.key();

        let seeds = &[
            b"market",
            market_fixture_id.as_bytes(),
            &[market_bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.depositor_token_account.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer,
            ),
            payout,
        )?;

        position.claimed = true;
        let _ = market_key;
        Ok(())
    }
}

fn derive_winning_outcome(fixture_id: &str, home_score: i32, away_score: i32) -> Result<u8> {
    let market_type = parse_market_type(fixture_id)?;

    match market_type {
        MarketKind::MatchWinner => {
            if home_score > away_score {
                Ok(0)
            } else if home_score == away_score {
                Ok(1)
            } else {
                Ok(2)
            }
        }
        MarketKind::TotalGoals => {
            let total = home_score + away_score;
            if total > 2 {
                Ok(0) // over
            } else {
                Ok(1) // under
            }
        }
        MarketKind::BothTeamsScore => {
            if home_score > 0 && away_score > 0 {
                Ok(0) // yes
            } else {
                Ok(1) // no
            }
        }
    }
}

enum MarketKind {
    MatchWinner,
    TotalGoals,
    BothTeamsScore,
}

fn parse_market_type(fixture_id: &str) -> Result<MarketKind> {
    if fixture_id.ends_with(":match_winner") {
        Ok(MarketKind::MatchWinner)
    } else if fixture_id.ends_with(":total_goals") {
        Ok(MarketKind::TotalGoals)
    } else if fixture_id.ends_with(":both_teams_score") {
        Ok(MarketKind::BothTeamsScore)
    } else {
        err!(PredictError::UnknownMarketType)
    }
}

#[derive(Accounts)]
#[instruction(fixture_id: String)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", fixture_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome_index: u8)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + Position::INIT_SPACE,
        seeds = [
            b"position",
            market.key().as_ref(),
            depositor.key().as_ref(),
            &[outcome_index],
        ],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub depositor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.key() == market.vault @ PredictError::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    pub keeper: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: TxLINE daily scores merkle roots PDA
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: TxLINE oracle program for CPI validate_stat (mainnet or devnet)
    pub txline_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        constraint = position.depositor == depositor.key() @ PredictError::UnauthorizedKeeper,
        constraint = position.market == market.key() @ PredictError::InvalidVault,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = vault.key() == market.vault @ PredictError::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key() @ PredictError::UnauthorizedKeeper,
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub vault: Pubkey,
    #[max_len(64)]
    pub fixture_id: String,
    pub outcome_count: u8,
    pub lock_timestamp: i64,
    pub status: MarketStatus,
    pub total_deposited: u64,
    pub outcome_pools: [u64; MAX_OUTCOMES],
    pub winning_outcome: Option<u8>,
    pub settlement_root: Option<[u8; 32]>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub depositor: Pubkey,
    pub outcome_index: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    Open,
    Locked,
    Resolved,
    Cancelled,
}

#[error_code]
pub enum PredictError {
    #[msg("Market is closed or already resolved")]
    MarketClosed,
    #[msg("Market is locked for betting")]
    MarketLocked,
    #[msg("Market is not resolved yet")]
    MarketNotResolved,
    #[msg("Invalid outcome index")]
    InvalidOutcome,
    #[msg("Outcome count must be between 2 and 8")]
    InvalidOutcomes,
    #[msg("Deposit amount must be positive")]
    InvalidAmount,
    #[msg("Fixture id too long")]
    FixtureIdTooLong,
    #[msg("Vault does not match market")]
    InvalidVault,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Unauthorized keeper")]
    UnauthorizedKeeper,
    #[msg("Winning outcome does not match verified scores")]
    WinningOutcomeMismatch,
    #[msg("Position already claimed")]
    AlreadyClaimed,
    #[msg("Only winning outcome positions may claim")]
    NotWinner,
    #[msg("Winning pool is empty")]
    EmptyWinningPool,
    #[msg("Unknown market type in fixture id")]
    UnknownMarketType,
    #[msg("Invalid TxLINE oracle program id")]
    InvalidTxLineProgram,
}

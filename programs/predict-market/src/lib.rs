use anchor_lang::prelude::*;

declare_id!("PredMkt1111111111111111111111111111111111111");

/// TxLINE mainnet program — CPI target for validate_stat settlement.
pub const TXLINE_PROGRAM_ID: Pubkey = pubkey!("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");

#[program]
pub mod predict_market {
    use super::*;

    /// Create a binary/multi-outcome market escrow for a World Cup fixture.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: String,
        outcome_count: u8,
        lock_timestamp: i64,
    ) -> Result<()> {
        require!(outcome_count >= 2 && outcome_count <= 8, PredictError::InvalidOutcomes);
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.fixture_id = fixture_id;
        market.outcome_count = outcome_count;
        market.lock_timestamp = lock_timestamp;
        market.status = MarketStatus::Open;
        market.total_deposited = 0;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    /// Deposit USDC into a specific outcome side of the pool.
    pub fn deposit(ctx: Context<Deposit>, outcome_index: u8, amount: u64) -> Result<()> {
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

        // SPL token transfer into vault handled by anchor-spl in full implementation
        ctx.accounts.market.total_deposited = ctx
            .accounts
            .market
            .total_deposited
            .checked_add(amount)
            .ok_or(PredictError::Overflow)?;

        Ok(())
    }

    /// Settle market after keeper submits TxLINE Merkle proof via CPI.
    /// Full implementation will invoke txoracle::validate_stat before releasing funds.
    pub fn settle_market(
        ctx: Context<SettleMarket>,
        winning_outcome: u8,
        _proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, PredictError::MarketClosed);
        require!(
            winning_outcome < market.outcome_count,
            PredictError::InvalidOutcome
        );

        // TODO: CPI into TxLINE validate_stat instruction
        // invoke_signed CPI with proof leaves to verify final score on-chain

        market.status = MarketStatus::Resolved;
        market.winning_outcome = Some(winning_outcome);
        Ok(())
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

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    pub keeper: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: TxLINE oracle program for CPI validate_stat
    #[account(address = TXLINE_PROGRAM_ID)]
    pub txline_program: UncheckedAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    #[max_len(64)]
    pub fixture_id: String,
    pub outcome_count: u8,
    pub lock_timestamp: i64,
    pub status: MarketStatus,
    pub total_deposited: u64,
    pub winning_outcome: Option<u8>,
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
    #[msg("Invalid outcome index")]
    InvalidOutcome,
    #[msg("Outcome count must be between 2 and 8")]
    InvalidOutcomes,
    #[msg("Arithmetic overflow")]
    Overflow,
}

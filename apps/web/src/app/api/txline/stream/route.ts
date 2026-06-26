import {
  buildStreamHeaders,
  formatStreamPayload,
  getStreamEndpoints,
  parseSseBuffer,
  type StreamChannel,
  type TxLineStreamEvent,
} from "@txline-predict/txline-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_MESSAGES: TxLineStreamEvent[] = [
  {
    type: "odds",
    fixtureId: "wc-2026-001",
    message: "Brazil vs Germany — home implied 42% → 43%",
    at: new Date().toISOString(),
  },
  {
    type: "score",
    fixtureId: "wc-2026-002",
    homeScore: 1,
    awayScore: 1,
    isLive: true,
    message: "Argentina 1-1 France — GOAL 67'",
    at: new Date().toISOString(),
  },
];

async function pipeUpstream(
  apiToken: string,
  channel: StreamChannel,
  send: (ev: TxLineStreamEvent) => void,
  signal: AbortSignal
) {
  const { oddsStream, scoresStream } = getStreamEndpoints({ apiToken });
  const url = channel === "scores" ? scoresStream : oddsStream;
  const headers = await buildStreamHeaders({ apiToken });

  const upstream = await fetch(url, { headers, signal });
  if (!upstream.ok || !upstream.body) {
    throw new Error(`Upstream ${channel} stream failed: ${upstream.status}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseBuffer(buffer, (raw) => {
      try {
        const payload = JSON.parse(raw) as Record<string, unknown>;
        const formatted = formatStreamPayload(payload, channel);
        if (formatted) send(formatted);
      } catch {
        /* skip malformed */
      }
    });
  }
}

/** Multiplex TxLINE odds + scores SSE into a single browser stream. */
export async function GET(request: Request) {
  const apiToken = process.env.TXLINE_API_TOKEN;
  const useDemo = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" || !apiToken;

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: TxLineStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };

      if (useDemo) {
        let i = 0;
        const interval = setInterval(() => {
          send({ ...DEMO_MESSAGES[i % DEMO_MESSAGES.length], at: new Date().toISOString() });
          i++;
        }, 4000);
        abort.signal.addEventListener("abort", () => clearInterval(interval));
        return;
      }

      send({
        type: "status",
        message: "Connected to TxLINE odds + scores streams",
        at: new Date().toISOString(),
      });

      const runChannel = async (channel: StreamChannel) => {
        while (!abort.signal.aborted) {
          try {
            await pipeUpstream(apiToken, channel, send, abort.signal);
          } catch {
            if (!abort.signal.aborted) {
              send({
                type: "status",
                message: `${channel} stream reconnecting…`,
                at: new Date().toISOString(),
              });
              await new Promise((r) => setTimeout(r, 3000));
            }
          }
        }
      };

      await Promise.all([runChannel("odds"), runChannel("scores")]);
      controller.close();
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

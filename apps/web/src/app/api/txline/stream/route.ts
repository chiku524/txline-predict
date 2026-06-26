import { getStreamEndpoints } from "@txline-predict/txline-client";

export const dynamic = "force-dynamic";

/** Proxies TxLINE data to the browser as SSE (keeps API token server-side). */
export async function GET() {
  const apiToken = process.env.TXLINE_API_TOKEN;
  const useDemo = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" || !apiToken;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const demoMessages = [
        { type: "odds", message: "Brazil vs Germany — home implied 42% → 43%" },
        { type: "score", message: "Argentina 1-1 France — GOAL 67'" },
        { type: "status", message: "Market mkt-002 locked at kickoff" },
      ];
      let i = 0;

      const interval = setInterval(async () => {
        if (useDemo) {
          send(demoMessages[i % demoMessages.length]);
          i++;
          return;
        }

        try {
          const { oddsSnapshot } = getStreamEndpoints({ apiToken, useDevnet: false });
          const res = await fetch(oddsSnapshot, {
            headers: { Authorization: `Bearer ${apiToken}` },
          });
          if (res.ok) {
            const snippet = (await res.text()).slice(0, 180);
            send({ type: "odds", message: snippet || "TxLINE odds update" });
          }
        } catch {
          send({ type: "status", message: "TxLINE poll failed — retrying" });
        }
        i++;
      }, 5000);

      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

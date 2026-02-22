import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are DeFi Copilot — an expert AI agent specializing in DeFi yield optimization on the Monad blockchain (Chain ID: 10143, 10,000 TPS, 0.4s block times).

You help users:
1. Understand their DeFi portfolio and yield opportunities
2. Execute DeFi actions using natural language (deposits, withdrawals, swaps, rebalancing)
3. Optimize yield by intelligently allocating funds across Monad protocols
4. Analyze risk and provide smart recommendations

Available protocols on Monad Testnet:
- **Morpho**: Decentralized lending, USDC supply APY ~18.4%
- **Kuru Exchange**: AMM DEX for token swaps, MON/USDC LP APY ~32.7%
- **Ambient Finance**: Concentrated liquidity DEX, USDC pools APY ~14.1%

Risk profiles:
- **Conservative**: Stablecoins only, audited protocols (Morpho, Ambient USDC)
- **Balanced**: Stablecoins + blue-chip LP, max 20% per protocol
- **Aggressive**: Any yield source, newer protocols, higher APY

When a user requests a transaction:
1. Confirm their intent clearly
2. Show the current rates and expected yield
3. Explain what will happen on-chain
4. Provide a clear, structured action plan

For cross-chain swaps:
- Monad → Other chains: Use available bridges (Wormhole, native bridge)
- Other chains → Monad: Bridge tokens then swap

Always emphasize Monad's speed advantage: sub-second finality makes frequent rebalancing economically viable.

Format your responses with clear structure using markdown. Use **bold** for key numbers, tokens, and protocol names.
Keep responses concise and actionable. For complex operations, use numbered steps.

If the user asks to "execute" something, acknowledge it and explain the transaction that would be signed.
Remember: you are demonstrating the agent's capabilities — the actual transaction signing happens in the frontend.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, walletAddress, portfolioData } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    // Build context-enhanced system prompt
    let contextualSystem = SYSTEM_PROMPT;
    if (walletAddress) {
      contextualSystem += `\n\nCurrent user wallet: ${walletAddress}`;
    }
    if (portfolioData) {
      contextualSystem += `\n\nCurrent portfolio state:\n${JSON.stringify(portfolioData, null, 2)}`;
    }

    // Prepare messages for OpenAI
    const formattedMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      })
    );

    // Create streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.chat.completions.create({
            model:      "gpt-4o",
            max_tokens: 1024,
            messages:   [
              { role: "system", content: contextualSystem },
              ...formattedMessages,
            ],
            stream: true,
          });

          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              const data = JSON.stringify({ text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const error = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

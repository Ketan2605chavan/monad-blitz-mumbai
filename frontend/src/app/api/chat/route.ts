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

Available tokens on Monad Testnet:
- **MON**: Native token (like ETH)
- **mETH**: Mock ETH token (ERC-20, 18 decimals)
- **WMON**: Wrapped MON

Available protocols on Monad Testnet:
- **Morpho**: Decentralized lending, USDC supply APY ~18.4%
- **Kuru Exchange**: AMM DEX for token swaps, MON/USDC LP APY ~32.7%
- **Ambient Finance**: Concentrated liquidity DEX, USDC pools APY ~14.1%

Risk profiles:
- **Conservative**: Stablecoins only, audited protocols (Morpho, Ambient USDC)
- **Balanced**: Stablecoins + blue-chip LP, max 20% per protocol
- **Aggressive**: Any yield source, newer protocols, higher APY

IMPORTANT — When a user asks to swap/exchange/trade/convert tokens:
You MUST call the "execute_swap" function with the parsed parameters. Do NOT just describe the swap — actually call the function.
Supported swap pairs: MON ↔ mETH. Rate is ~1 MON = 1800 mETH (fluctuates ±1.2%).

For other actions (deposits, withdrawals, portfolio questions), respond with helpful markdown text.

Always emphasize Monad's speed advantage: sub-second finality makes frequent rebalancing economically viable.
Format your responses with clear structure using markdown. Use **bold** for key numbers, tokens, and protocol names.
Keep responses concise and actionable.`;

// ─── OpenAI Function definitions for swap ──────────────────────────────────

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "execute_swap",
      description: "Execute a token swap on Monad testnet. Call this when the user wants to swap/exchange/trade/convert tokens.",
      parameters: {
        type: "object",
        properties: {
          fromToken: {
            type: "string",
            enum: ["MON", "mETH"],
            description: "The token to swap FROM",
          },
          toToken: {
            type: "string",
            enum: ["MON", "mETH"],
            description: "The token to swap TO",
          },
          amount: {
            type: "string",
            description: "The amount of fromToken to swap (as a decimal string, e.g. '0.5')",
          },
        },
        required: ["fromToken", "toToken", "amount"],
      },
    },
  },
];

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

    // First call: check if AI wants to call a function (swap)
    const initialResponse = await client.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: 1024,
      messages:   [
        { role: "system", content: contextualSystem },
        ...formattedMessages,
      ],
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = initialResponse.choices[0];

    // If the AI called the execute_swap function
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === "execute_swap") {
        const args = JSON.parse(toolCall.function.arguments);
        const { fromToken, toToken, amount } = args;

        // Calculate estimate (1 MON ≈ 1800 mETH)
        const rate = 1800;
        let estimatedOutput: string;
        if (fromToken === "MON" && toToken === "mETH") {
          estimatedOutput = (parseFloat(amount) * rate).toFixed(2);
        } else {
          estimatedOutput = (parseFloat(amount) / rate).toFixed(6);
        }

        // Return a special JSON action response
        const actionPayload = {
          action: "swap",
          fromToken,
          toToken,
          amount,
          estimatedOutput,
          message: `I'll swap **${amount} ${fromToken}** → **~${estimatedOutput} ${toToken}** for you on Monad Testnet.\n\nPlease confirm the transaction below and sign with your wallet.`,
        };

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const data = JSON.stringify({ action: actionPayload });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
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
      }
    }

    // Normal text response (no function call) — stream it
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // If we already have a non-streaming response, send it
          if (choice.message.content) {
            const data = JSON.stringify({ text: choice.message.content });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Otherwise make a new streaming call without tools
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

import OpenAI from "openai";

import { planReasoning, storyModel } from "@/lib/live/config";

export async function storyJson(
  instructions: string,
  input: string,
  name: string,
  schema: { [key: string]: unknown },
): Promise<unknown> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY on the server");
  const client = new OpenAI({ maxRetries: 0, timeout: 22_000 });
  const response = await client.responses.create({
    model: storyModel(),
    reasoning: planReasoning,
    instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name,
        strict: true,
        schema,
      },
    },
  });
  return JSON.parse(response.output_text);
}

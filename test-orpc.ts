import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouter } from "./server/api/root"; 
import type { RouterClient } from "@orpc/server"; 

async function test() {
  const link = new RPCLink({
    url: "http://127.0.0.1:3000/api/orpc",
  });
  const client = createORPCClient<RouterClient<AppRouter>>(link);

  try {
    console.log("Testing getQuestions with quizId...");
    const res = await client.instructor.getQuestions({ quizId: "123" });
    console.log("Success:", res);
  } catch (err: any) {
    console.error("Error with quizId:", err?.data || err);
  }

  try {
    console.log("Testing getQuestions with undefined...");
    const res = await client.instructor.getQuestions(undefined as any);
    console.log("Success:", res);
  } catch (err: any) {
    console.error("Error with undefined:", err?.data || err);
  }
}

test();

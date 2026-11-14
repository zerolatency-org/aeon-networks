// scripts/mock-router.ts
// A local stand-in for the 0G Router, for trying the server without an API key.
// Every chat request gets the same short streamed reply. Prints the base URL to use.
//   bun scripts/mock-router.ts
import { startMockRouter } from "../packages/harness/src/mock-router";

const router = startMockRouter();
const reply = {
	text: ["Ahoy! ", "I am the local mock ", "of the 0G Router."],
	trace: "777",
};
// keep a few replies queued at all times
setInterval(() => {
	router.reset();
	router.script(reply, reply, reply);
}, 50);
console.log(`ROUTER_BASE_URL=${router.url}`);

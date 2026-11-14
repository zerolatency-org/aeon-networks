// apps/web/test/register-dom.ts
// Runs before every test file: adds window, document and friends.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

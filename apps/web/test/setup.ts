// apps/web/test/setup.ts
// Runs after the DOM exists: unmounts whatever a test rendered.

import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

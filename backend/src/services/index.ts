// Import both implementations
import { SessionManager as SessionManager1 } from "./sessionManager";
import { SessionManager as SessionManager2 } from "./sessionManager2";
import { ContainerManager as ContainerManager1 } from "./containerManager";
import { ContainerManager as ContainerManager2 } from "./containerManager2";

// Re-export interfaces (they are the same in both implementations)
export type { SessionInfo } from "./sessionManager";

// Export the appropriate implementation based on environment variable
export const SessionManager =
  process.env.USE_DOCKERODE === "true" ? SessionManager2 : SessionManager1;

export const ContainerManager =
  process.env.USE_DOCKERODE === "true" ? ContainerManager2 : ContainerManager1;
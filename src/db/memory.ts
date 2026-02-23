import { Memory } from "openmemory-js";

// Initialize a singleton instance of OpenMemory
// Behind the scenes, it manages its own SQLite vector store
export const openMemory = new Memory();

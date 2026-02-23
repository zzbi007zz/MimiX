import { Memory } from "openmemory-js";
import "dotenv/config";

async function run() {
    try {
        const mem = new Memory();
        await mem.add("User's favorite color is blue", { user_id: "test" });
        const res = await mem.search("color", { user_id: "test" });
        console.log("Memory search results:", res);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();

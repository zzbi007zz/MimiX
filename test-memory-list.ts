import { openMemory } from "./src/db/memory";

async function run() {
    try {
        const res = await openMemory.search("*", { user_id: "test" });
        console.log("Memory get results:", res);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();

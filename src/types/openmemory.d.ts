declare module 'openmemory-js' {
    export class Memory {
        constructor(config?: any);
        add(text: string, meta?: any): Promise<any>;
        search(query: string, meta?: any): Promise<any>;
        delete(id: string): Promise<any>;
        get(id: string): Promise<any>;
        list(meta?: any): Promise<any>;
    }
}

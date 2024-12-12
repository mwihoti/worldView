import { getPostsByAuthor } from "@/lib/requests";

export default async function Sports() {
    const posts = await getPostsByAuthor("Dennis Wekesa", "");

    return (
        <div className="max-w-7xl mx-auto p-5">
            <h1 className="text-3xl font-bold mb-5">Sports Articles</h1>
           
        </div>
    )
}
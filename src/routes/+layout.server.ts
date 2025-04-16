import { auth } from "$lib/server/auth";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({request}) => {
    const data = await auth.api.getSession({
        headers: request.headers
    });

    return data ?? { user: null, session: null };
}
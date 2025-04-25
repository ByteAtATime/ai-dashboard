import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { env } from '$env/dynamic/private';
import { createAuthMiddleware, organization } from 'better-auth/plugins';
import { v4 as uuidv4 } from 'uuid';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg'
	}),
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string
		}
	},
	plugins: [organization()],
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			const user = ctx.context.session?.user;
			if (!user) return;

			const existingOrgs = await auth.api.listOrganizations({
				headers: ctx.headers
			});

			if (existingOrgs.length === 0) {
				const org = await auth.api.createOrganization({
					body: {
						name: `${user.name}'s Organization`,
						slug: uuidv4(),
						userId: user.id
					}
				});

				if (!org) return;
			}

			if (ctx.context.session?.session.activeOrganizationId) return;

			const orgs = await auth.api.listOrganizations({
				headers: ctx?.headers
			});

			if (orgs.length === 0) return;

			await auth.api.setActiveOrganization({
				body: {
					organizationId: orgs[0].id
				},
				headers: ctx.headers
			});
		})
	}
});

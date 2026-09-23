import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import type { RequestHandler } from './$types';

type TicketInput = { id: number; title: string; content: string };

const priorityQuestion = choice(
	'How urgently should the support team handle `ticket`, based on its title and content?',
	{
		high: 'Outage, data loss, security issue, payments or login broken, or many users blocked',
		medium: 'A feature is degraded or slow, a workaround exists, or only some users are affected',
		low: 'Cosmetic issue, typo, minor UX polish, or nice-to-have request'
	}
);

export const POST: RequestHandler = async ({ request }) => {
	if (!env.TYPESAFE_API_KEY) error(500, 'TYPESAFE_API_KEY is not set');
	const { tickets } = (await request.json()) as { tickets: TicketInput[] };
	const client = new TypeSafeClient({ apiKey: env.TYPESAFE_API_KEY });

	try {
		const results = await Promise.all(
			tickets.map(async ({ id, title, content }) => {
				const { answers } = await client.systemOne({
					state: { ticket: { title, content } },
					questions: { priority: priorityQuestion }
				});
				const { choice: priority, probabilities } = answers.priority;
				return { id, priority, confidence: Math.round(probabilities[priority] * 100) };
			})
		);
		return json(results);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'TypeSafe request failed' }, { status: 502 });
	}
};

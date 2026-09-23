<script lang="ts">
	import { flip } from 'svelte/animate';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { onMount } from 'svelte';

	type Priority = 'high' | 'medium' | 'low';
	type Ticket = { id: number; title: string; content: string; priority: Priority };
	type Column = { id: 'review' | Priority; title: string; accent: string; items: Ticket[] };
	type Suggestion = { priority: Priority; confidence: number };

	const priorityStyle: Record<Priority, string> = {
		high: 'bg-red-500/10 text-red-600 dark:text-red-400',
		medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
		low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
	};
	const reviewStyle = 'bg-sky-500/10 text-sky-600 dark:text-sky-400';

	let columns = $state<Column[]>([
		{
			id: 'review',
			title: 'In Review',
			accent: 'bg-sky-500',
			items: [
				{ id: 1, title: 'Login fails on Safari 17', content: 'Users on Safari 17 get stuck on a blank screen after submitting the login form. Suspect a cookie SameSite issue.', priority: 'high' },
				{ id: 2, title: 'Typo on pricing page', content: '"Anually" should read "Annually" on the pricing toggle.', priority: 'low' },
				{ id: 3, title: 'Slow dashboard load', content: 'Dashboard takes ~6s to load for accounts with more than 500 projects.', priority: 'medium' }
			]
		},
		{
			id: 'high',
			title: 'High',
			accent: 'bg-red-500',
			items: [
				{ id: 4, title: 'Payment webhook failing', content: 'Stripe webhooks return 500 since last deploy. Orders are not being marked as paid.', priority: 'high' },
				{ id: 5, title: 'Password reset email not sent', content: 'Several customers report never receiving the reset email. Check the mail queue worker.', priority: 'high' }
			]
		},
		{
			id: 'medium',
			title: 'Medium',
			accent: 'bg-amber-500',
			items: [
				{ id: 6, title: 'Export CSV timeout', content: 'Exporting more than 10k rows times out. Move the export to a background job.', priority: 'medium' },
				{ id: 7, title: 'Notification badge count wrong', content: 'Badge still shows unread count after all notifications are opened.', priority: 'medium' },
				{ id: 8, title: 'Search ignores accents', content: 'Searching "cafe" does not match "café". Normalize input before querying.', priority: 'medium' }
			]
		},
		{
			id: 'low',
			title: 'Low',
			accent: 'bg-emerald-500',
			items: [
				{ id: 9, title: 'Dark mode logo contrast', content: 'Logo is hard to see on the dark theme header.', priority: 'low' },
				{ id: 10, title: 'Add tooltip to archive button', content: 'Icon-only archive button needs a tooltip for clarity.', priority: 'low' }
			]
		}
	]);

	const review = $derived(columns[0]);
	let suggestions = $state<Record<number, Suggestion>>({});
	let scoring = $state<Record<number, boolean>>({});
	let scoreError = $state('');
	let pending: Promise<unknown> = Promise.resolve();

	// Only tickets sitting in In Review are ever sent for scoring.
	function score() {
		const todo = review.items.filter((t) => !suggestions[t.id] && !scoring[t.id]);
		if (!todo.length) return pending;
		const run = requestScores(todo);
		pending = Promise.all([pending, run]);
		return run;
	}

	async function requestScores(todo: Ticket[]) {
		for (const t of todo) scoring[t.id] = true;
		scoreError = '';
		try {
			const res = await fetch('/api/prioritize', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ tickets: todo.map(({ id, title, content }) => ({ id, title, content })) })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? data.message ?? 'Scoring failed');
			for (const { id, priority, confidence } of data as (Suggestion & { id: number })[]) {
				if (review.items.some((t) => t.id === id)) suggestions[id] = { priority, confidence };
			}
		} catch (e) {
			scoreError = e instanceof Error ? e.message : 'Scoring failed';
		} finally {
			for (const t of todo) delete scoring[t.id];
		}
	}

	function moveTo(ticket: Ticket, priority: Priority) {
		review.items = review.items.filter((t) => t.id !== ticket.id);
		columns.find((c) => c.id === priority)!.items.push({ ...ticket, priority });
		delete suggestions[ticket.id];
	}

	async function autoSort() {
		await pending;
		await score();
		for (const t of [...review.items]) {
			const s = suggestions[t.id];
			if (s) moveTo(t, s.priority);
		}
	}

	onMount(score);

	function consider(col: Column, e: CustomEvent<DndEvent<Ticket>>) {
		col.items = e.detail.items;
	}

	function finalize(col: Column, e: CustomEvent<DndEvent<Ticket>>) {
		const id = col.id;
		if (id === 'review') {
			col.items = e.detail.items;
			score();
		} else {
			col.items = e.detail.items.map((t) => ({ ...t, priority: id }));
			for (const t of col.items) delete suggestions[t.id];
		}
	}

	// Keep clicks on card buttons from starting a drag.
	const stop = (e: Event) => e.stopPropagation();
</script>

<main class="min-h-screen bg-background px-4 py-8 md:px-8">
	<header class="mb-8">
		<h1 class="text-2xl font-semibold tracking-tight">Ticket Priority Board</h1>
		<p class="text-sm text-muted-foreground">Drag tickets between columns, or let Jev recommend a priority for tickets in review.</p>
	</header>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each columns as col (col.id)}
			<div class="flex flex-col overflow-hidden rounded-xl border bg-muted/40">
				<div class="h-1 {col.accent}"></div>
				<div class="flex items-center justify-between px-4 py-3">
					<h2 class="text-sm font-medium">{col.title}</h2>
					<div class="flex items-center gap-2">
						{#if col.id === 'review'}
							<Button size="xs" variant="outline" disabled={!col.items.length} onclick={autoSort}>Auto-sort</Button>
						{/if}
						<Badge variant="secondary">{col.items.length}</Badge>
					</div>
				</div>
				{#if col.id === 'review' && scoreError}
					<p class="px-4 pb-2 text-xs text-destructive">{scoreError}</p>
				{/if}
				<section
					class="flex min-h-40 flex-1 flex-col gap-3 px-3 pb-3"
					use:dndzone={{ items: col.items, flipDurationMs: 200, dropTargetStyle: {} }}
					onconsider={(e) => consider(col, e)}
					onfinalize={(e) => finalize(col, e)}
				>
					{#each col.items as ticket (ticket.id)}
						<div animate:flip={{ duration: 200 }} class="cursor-grab active:cursor-grabbing">
							<Card.Root class="gap-2 py-4 shadow-sm transition-shadow hover:shadow-md">
								<Card.Header class="px-4">
									<Card.Title class="text-sm">{ticket.title}</Card.Title>
								</Card.Header>
								<Card.Content class="space-y-3 px-4">
									<p class="line-clamp-3 text-sm text-muted-foreground">{ticket.content}</p>
									<!-- transition-none: Badge's transition-all animates the dnd shadow's visibility:hidden, leaving a ghost badge -->
									{#if col.id === 'review'}
										{@const s = suggestions[ticket.id]}
										<div class="flex flex-wrap items-center gap-2">
											<Badge class="transition-none {reviewStyle}" variant="outline">In Review</Badge>
											{#if s}
												<Button
													size="xs"
													variant="outline"
													class="capitalize transition-none {priorityStyle[s.priority]}"
													title="Move to {s.priority}"
													onmousedown={stop}
													ontouchstart={stop}
													onkeydown={stop}
													onclick={() => moveTo(ticket, s.priority)}
												>
													Recommend: {s.priority} ({s.confidence}%)
												</Button>
											{:else if scoring[ticket.id]}
												<Badge class="transition-none" variant="outline">Scoring…</Badge>
											{/if}
										</div>
									{:else}
										<Badge class="capitalize transition-none {priorityStyle[ticket.priority]}" variant="outline">
											{ticket.priority}
										</Badge>
									{/if}
								</Card.Content>
							</Card.Root>
						</div>
					{/each}
				</section>
			</div>
		{/each}
	</div>
</main>

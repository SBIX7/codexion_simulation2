#include "codexion.h"

static int	request_cmp(t_request *a, t_request *b, t_scheduler scheduler)
{
	if (scheduler == CODEX_SCHED_FIFO)
	{
		if (a->seq != b->seq)
			return (a->seq < b->seq);
		return (a->coder_idx < b->coder_idx);
	}
	if (a->deadline != b->deadline)
		return (a->deadline < b->deadline);
	if (a->seq != b->seq)
		return (a->seq < b->seq);
	return (a->coder_idx < b->coder_idx);
}

static void	heap_swap(t_request **a, t_request **b)
{
	t_request	*tmp;

	tmp = *a;
	*a = *b;
	*b = tmp;
}

static void	heapify_up(t_dongle *d, int idx)
{
	int	parent;

	while (idx > 0)
	{
		parent = (idx - 1) / 2;
		if (!request_cmp(d->heap[idx], d->heap[parent], d->scheduler))
			break ;
		heap_swap(&d->heap[idx], &d->heap[parent]);
		idx = parent;
	}
}

static void	heapify_down(t_dongle *d, int idx)
{
	int	left;
	int	right;
	int	smallest;

	while (1)
	{
		left = idx * 2 + 1;
		right = idx * 2 + 2;
		smallest = idx;
		if (left < d->heap_size
			&& request_cmp(d->heap[left], d->heap[smallest], d->scheduler))
			smallest = left;
		if (right < d->heap_size
			&& request_cmp(d->heap[right], d->heap[smallest], d->scheduler))
			smallest = right;
		if (smallest == idx)
			break ;
		heap_swap(&d->heap[idx], &d->heap[smallest]);
		idx = smallest;
	}
}

static int	heap_find_index(t_dongle *d, t_request *req)
{
	int	i;

	i = 0;
	while (i < d->heap_size)
	{
		if (d->heap[i] == req)
			return (i);
		i++;
	}
	return (-1);
}

static void	heap_push(t_dongle *d, t_request *req)
{
	d->heap[d->heap_size] = req;
	heapify_up(d, d->heap_size);
	d->heap_size++;
}

static void	heap_remove_at(t_dongle *d, int idx)
{
	if (idx < 0 || idx >= d->heap_size)
		return ;
	d->heap_size--;
	d->heap[idx] = d->heap[d->heap_size];
	heapify_down(d, idx);
	heapify_up(d, idx);
}

int	acquire_dongle(t_simulation *sim, int dongle_idx, int coder_idx)
{
	t_dongle		*d;
	t_request		request;
	struct timespec	ts;
	long long		wait_ms;

	d = &sim->dongles[dongle_idx];
	pthread_mutex_lock(&d->mutex);
	request.coder_idx = coder_idx;
	request.seq = ++d->seq_counter;
	request.deadline = sim->coders[coder_idx].last_compile_start + sim->time_to_burnout;
	heap_push(d, &request);
	while (!sim_is_stopped(sim))
	{
		if (d->heap_size > 0 && d->heap[0] == &request && d->holder == -1
			&& elapsed_ms(sim) >= d->cooldown_until)
		{
			heap_remove_at(d, 0);
			d->holder = coder_idx;
			pthread_mutex_unlock(&d->mutex);
			return (1);
		}
		wait_ms = 2;
		if (d->heap_size > 0 && d->heap[0] == &request && d->holder == -1
			&& elapsed_ms(sim) < d->cooldown_until)
			wait_ms = d->cooldown_until - elapsed_ms(sim);
		if (wait_ms < 1)
			wait_ms = 1;
		ms_to_timespec_from_now(wait_ms, &ts);
		pthread_cond_timedwait(&d->cond, &d->mutex, &ts);
	}
	heap_remove_at(d, heap_find_index(d, &request));
	pthread_cond_broadcast(&d->cond);
	pthread_mutex_unlock(&d->mutex);
	return (0);
}

void	release_dongle(t_simulation *sim, int dongle_idx, int coder_idx)
{
	t_dongle	*d;

	d = &sim->dongles[dongle_idx];
	pthread_mutex_lock(&d->mutex);
	if (d->holder == coder_idx)
	{
		d->holder = -1;
		d->cooldown_until = elapsed_ms(sim) + sim->dongle_cooldown;
	}
	pthread_cond_broadcast(&d->cond);
	pthread_mutex_unlock(&d->mutex);
}

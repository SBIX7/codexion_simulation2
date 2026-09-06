#include "codexion.h"

static int	init_dongles(t_simulation *sim)
{
	int	i;

	sim->dongles = malloc(sizeof(t_dongle) * sim->n_coders);
	if (!sim->dongles)
		return (0);
	i = 0;
	while (i < sim->n_coders)
	{
		memset(&sim->dongles[i], 0, sizeof(t_dongle));
		sim->dongles[i].holder = -1;
		sim->dongles[i].scheduler = sim->scheduler;
		sim->dongles[i].heap_capacity = sim->n_coders + 2;
		sim->dongles[i].heap = malloc(sizeof(t_request *)
				* sim->dongles[i].heap_capacity);
		if (!sim->dongles[i].heap)
			return (0);
		if (pthread_mutex_init(&sim->dongles[i].mutex, NULL) != 0
			|| pthread_cond_init(&sim->dongles[i].cond, NULL) != 0)
			return (0);
		i++;
	}
	return (1);
}

static int	init_coders(t_simulation *sim)
{
	int	i;

	sim->coders = malloc(sizeof(t_coder) * sim->n_coders);
	if (!sim->coders)
		return (0);
	i = 0;
	while (i < sim->n_coders)
	{
		memset(&sim->coders[i], 0, sizeof(t_coder));
		sim->coders[i].id = i + 1;
		sim->coders[i].left_dongle = i;
		sim->coders[i].right_dongle = (i + 1) % sim->n_coders;
		sim->coders[i].last_compile_start = 0;
		sim->coders[i].sim = sim;
		if (pthread_mutex_init(&sim->coders[i].mutex, NULL) != 0)
			return (0);
		i++;
	}
	return (1);
}

int	init_simulation(t_simulation *sim)
{
	if (pthread_mutex_init(&sim->stop_mutex, NULL) != 0)
		return (0);
	if (pthread_mutex_init(&sim->log_mutex, NULL) != 0)
		return (0);
	if (!init_dongles(sim))
		return (0);
	if (!init_coders(sim))
		return (0);
	return (1);
}

int	run_simulation(t_simulation *sim)
{
	int	i;

	sim->start_ms = get_real_ms();
	i = 0;
	while (i < sim->n_coders)
	{
		if (pthread_create(&sim->coders[i].thread, NULL, coder_thread,
				&sim->coders[i]) != 0)
			return (0);
		i++;
	}
	if (pthread_create(&sim->monitor_thread, NULL, monitor_thread, sim) != 0)
		return (0);
	pthread_join(sim->monitor_thread, NULL);
	i = 0;
	while (i < sim->n_coders)
	{
		pthread_join(sim->coders[i].thread, NULL);
		i++;
	}
	return (1);
}

void	cleanup_simulation(t_simulation *sim)
{
	int	i;

	i = 0;
	while (sim->dongles && i < sim->n_coders)
	{
		pthread_mutex_destroy(&sim->dongles[i].mutex);
		pthread_cond_destroy(&sim->dongles[i].cond);
		free(sim->dongles[i].heap);
		i++;
	}
	i = 0;
	while (sim->coders && i < sim->n_coders)
	{
		pthread_mutex_destroy(&sim->coders[i].mutex);
		i++;
	}
	free(sim->dongles);
	free(sim->coders);
	pthread_mutex_destroy(&sim->log_mutex);
	pthread_mutex_destroy(&sim->stop_mutex);
}

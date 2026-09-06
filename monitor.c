#include "codexion.h"

static int	check_burnout(t_simulation *sim, int i, long long now)
{
	long long	last_start;
	int			compiling;
	int			completed;

	pthread_mutex_lock(&sim->coders[i].mutex);
	last_start = sim->coders[i].last_compile_start;
	compiling = sim->coders[i].is_compiling;
	completed = sim->coders[i].completed;
	pthread_mutex_unlock(&sim->coders[i].mutex);
	if (!completed && !compiling && now - last_start > sim->time_to_burnout)
	{
		sim_stop(sim, sim->coders[i].id);
		log_state(sim, sim->coders[i].id, "burned out", 1);
		return (1);
	}
	return (0);
}

static int	all_completed(t_simulation *sim)
{
	int	i;
	int	completed;

	if (sim->required_compiles <= 0)
		return (1);
	i = 0;
	while (i < sim->n_coders)
	{
		pthread_mutex_lock(&sim->coders[i].mutex);
		completed = sim->coders[i].completed;
		pthread_mutex_unlock(&sim->coders[i].mutex);
		if (!completed)
			return (0);
		i++;
	}
	return (1);
}

void	*monitor_thread(void *arg)
{
	t_simulation	*sim;
	long long		now;
	int				i;

	sim = (t_simulation *)arg;
	while (!sim_is_stopped(sim))
	{
		now = elapsed_ms(sim);
		i = 0;
		while (i < sim->n_coders)
		{
			if (check_burnout(sim, i, now))
				return (NULL);
			i++;
		}
		if (all_completed(sim))
		{
			sim_stop(sim, 0);
			return (NULL);
		}
		usleep(1000);
	}
	return (NULL);
}

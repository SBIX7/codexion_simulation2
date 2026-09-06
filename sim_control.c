#include "codexion.h"

int	sim_is_stopped(t_simulation *sim)
{
	int	value;

	pthread_mutex_lock(&sim->stop_mutex);
	value = sim->stop;
	pthread_mutex_unlock(&sim->stop_mutex);
	return (value);
}

void	sim_stop(t_simulation *sim, int burnout_coder)
{
	int	i;
	int	already_stopped;

	pthread_mutex_lock(&sim->stop_mutex);
	already_stopped = sim->stop;
	if (!sim->stop)
	{
		sim->stop = 1;
		sim->burnout_coder = burnout_coder;
	}
	pthread_mutex_unlock(&sim->stop_mutex);
	if (already_stopped)
		return ;
	i = 0;
	while (i < sim->n_coders)
	{
		pthread_mutex_lock(&sim->dongles[i].mutex);
		pthread_cond_broadcast(&sim->dongles[i].cond);
		pthread_mutex_unlock(&sim->dongles[i].mutex);
		i++;
	}
}

void	log_state(t_simulation *sim, int coder_id, const char *msg, int force)
{
	pthread_mutex_lock(&sim->log_mutex);
	if (force || !sim_is_stopped(sim))
		printf("%lld %d %s\n", elapsed_ms(sim), coder_id, msg);
	pthread_mutex_unlock(&sim->log_mutex);
}

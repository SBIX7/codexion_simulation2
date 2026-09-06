#include "codexion.h"

static void	set_coder_state(t_coder *coder, int compiling)
{
	pthread_mutex_lock(&coder->mutex);
	coder->is_compiling = compiling;
	if (compiling)
		coder->last_compile_start = elapsed_ms(coder->sim);
	pthread_mutex_unlock(&coder->mutex);
}

static int	has_completed_target(t_coder *coder)
{
	int	done;

	done = 0;
	if (coder->sim->required_compiles <= 0)
		return (1);
	pthread_mutex_lock(&coder->mutex);
	if (coder->compile_count >= coder->sim->required_compiles)
	{
		coder->completed = 1;
		done = 1;
	}
	pthread_mutex_unlock(&coder->mutex);
	return (done);
}

static int	acquire_two_dongles(t_coder *coder, int *first, int *second)
{
	if (coder->left_dongle < coder->right_dongle)
	{
		*first = coder->left_dongle;
		*second = coder->right_dongle;
	}
	else
	{
		*first = coder->right_dongle;
		*second = coder->left_dongle;
	}
	if (!acquire_dongle(coder->sim, *first, coder->id - 1))
		return (0);
	log_state(coder->sim, coder->id, "has taken a dongle", 0);
	if (!acquire_dongle(coder->sim, *second, coder->id - 1))
	{
		release_dongle(coder->sim, *first, coder->id - 1);
		return (0);
	}
	log_state(coder->sim, coder->id, "has taken a dongle", 0);
	return (1);
}

static void	increment_compile_count(t_coder *coder)
{
	pthread_mutex_lock(&coder->mutex);
	coder->compile_count++;
	if (coder->sim->required_compiles > 0
		&& coder->compile_count >= coder->sim->required_compiles)
		coder->completed = 1;
	pthread_mutex_unlock(&coder->mutex);
}

void	*coder_thread(void *arg)
{
	t_coder	*coder;
	int		first;
	int		second;

	coder = (t_coder *)arg;
	if (coder->sim->n_coders == 1)
	{
		if (acquire_dongle(coder->sim, coder->left_dongle, coder->id - 1))
			log_state(coder->sim, coder->id, "has taken a dongle", 0);
		while (!sim_is_stopped(coder->sim))
			usleep(1000);
		release_dongle(coder->sim, coder->left_dongle, coder->id - 1);
		return (NULL);
	}
	while (!sim_is_stopped(coder->sim) && !has_completed_target(coder))
	{
		if (!acquire_two_dongles(coder, &first, &second))
			break ;
		set_coder_state(coder, 1);
		log_state(coder->sim, coder->id, "is compiling", 0);
		sleep_ms_interruptible(coder->sim, coder->sim->time_to_compile);
		set_coder_state(coder, 0);
		increment_compile_count(coder);
		release_dongle(coder->sim, first, coder->id - 1);
		release_dongle(coder->sim, second, coder->id - 1);
		if (has_completed_target(coder) || sim_is_stopped(coder->sim))
			break ;
		log_state(coder->sim, coder->id, "is debugging", 0);
		sleep_ms_interruptible(coder->sim, coder->sim->time_to_debug);
		if (sim_is_stopped(coder->sim))
			break ;
		log_state(coder->sim, coder->id, "is refactoring", 0);
		sleep_ms_interruptible(coder->sim, coder->sim->time_to_refactor);
	}
	return (NULL);
}

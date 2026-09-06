#include "codexion.h"

long long	get_real_ms(void)
{
	struct timeval	tv;

	gettimeofday(&tv, NULL);
	return ((long long)tv.tv_sec * 1000LL + (long long)tv.tv_usec / 1000LL);
}

long long	elapsed_ms(t_simulation *sim)
{
	return (get_real_ms() - sim->start_ms);
}

void	ms_to_timespec_from_now(long long ms, struct timespec *ts)
{
	clock_gettime(CLOCK_REALTIME, ts);
	ts->tv_sec += ms / 1000LL;
	ts->tv_nsec += (ms % 1000LL) * 1000000LL;
	if (ts->tv_nsec >= 1000000000L)
	{
		ts->tv_sec += 1;
		ts->tv_nsec -= 1000000000L;
	}
}

void	sleep_ms_interruptible(t_simulation *sim, long long duration)
{
	long long	start;

	start = elapsed_ms(sim);
	while (!sim_is_stopped(sim) && elapsed_ms(sim) - start < duration)
		usleep(500);
}

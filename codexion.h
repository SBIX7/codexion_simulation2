#ifndef CODEXION_H
# define CODEXION_H

# include <pthread.h>
# include <stdio.h>
# include <stdlib.h>
# include <string.h>
# include <sys/time.h>
# include <unistd.h>

typedef enum e_scheduler
{
	CODEX_SCHED_FIFO,
	CODEX_SCHED_EDF
}   t_scheduler;

typedef struct s_simulation t_simulation;

typedef struct s_request
{
	int			coder_idx;
	long long	seq;
	long long	deadline;
}   t_request;

typedef struct s_dongle
{
	pthread_mutex_t	mutex;
	pthread_cond_t	cond;
	int				holder;
	long long		cooldown_until;
	t_request		**heap;
	int				heap_size;
	int				heap_capacity;
	long long		seq_counter;
	t_scheduler		scheduler;
}   t_dongle;

typedef struct s_coder
{
	pthread_t		thread;
	int				id;
	int				left_dongle;
	int				right_dongle;
	long long		last_compile_start;
	int				compile_count;
	int				is_compiling;
	int				completed;
	pthread_mutex_t	mutex;
	t_simulation	*sim;
}   t_coder;

struct s_simulation
{
	int				n_coders;
	long long		time_to_burnout;
	long long		time_to_compile;
	long long		time_to_debug;
	long long		time_to_refactor;
	int				required_compiles;
	long long		dongle_cooldown;
	t_scheduler		scheduler;
	long long		start_ms;
	int				stop;
	int				burnout_coder;
	pthread_mutex_t	stop_mutex;
	pthread_mutex_t	log_mutex;
	t_dongle		*dongles;
	t_coder			*coders;
	pthread_t		monitor_thread;
};

long long	get_real_ms(void);
long long	elapsed_ms(t_simulation *sim);
void		sleep_ms_interruptible(t_simulation *sim, long long duration);
void		ms_to_timespec_from_now(long long ms, struct timespec *ts);

int			parse_args(t_simulation *sim, int argc, char **argv);
int			init_simulation(t_simulation *sim);
int			run_simulation(t_simulation *sim);
void		cleanup_simulation(t_simulation *sim);

int			sim_is_stopped(t_simulation *sim);
void		sim_stop(t_simulation *sim, int burnout_coder);
void		log_state(t_simulation *sim, int coder_id, const char *msg,
				int force);

int			acquire_dongle(t_simulation *sim, int dongle_idx, int coder_idx);
void		release_dongle(t_simulation *sim, int dongle_idx, int coder_idx);

void		*coder_thread(void *arg);
void		*monitor_thread(void *arg);

#endif

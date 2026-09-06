#include "codexion.h"

static int	parse_nonneg_ll(const char *s, long long *out)
{
	long long	value;
	int			i;

	if (!s || !*s)
		return (0);
	value = 0;
	i = 0;
	while (s[i])
	{
		if (s[i] < '0' || s[i] > '9')
			return (0);
		if (value > (9223372036854775807LL - (s[i] - '0')) / 10)
			return (0);
		value = value * 10 + (s[i] - '0');
		i++;
	}
	*out = value;
	return (1);
}

int	parse_args(t_simulation *sim, int argc, char **argv)
{
	long long	value;

	if (argc != 9)
		return (0);
	if (!parse_nonneg_ll(argv[1], &value) || value <= 0)
		return (0);
	sim->n_coders = (int)value;
	if (!parse_nonneg_ll(argv[2], &sim->time_to_burnout) || sim->time_to_burnout <= 0)
		return (0);
	if (!parse_nonneg_ll(argv[3], &sim->time_to_compile) || sim->time_to_compile <= 0)
		return (0);
	if (!parse_nonneg_ll(argv[4], &sim->time_to_debug) || sim->time_to_debug <= 0)
		return (0);
	if (!parse_nonneg_ll(argv[5], &sim->time_to_refactor) || sim->time_to_refactor <= 0)
		return (0);
	if (!parse_nonneg_ll(argv[6], &value) || value < 0 || value > 2147483647LL)
		return (0);
	sim->required_compiles = (int)value;
	if (!parse_nonneg_ll(argv[7], &sim->dongle_cooldown) || sim->dongle_cooldown < 0)
		return (0);
	if (strcmp(argv[8], "fifo") == 0)
		sim->scheduler = CODEX_SCHED_FIFO;
	else if (strcmp(argv[8], "edf") == 0)
		sim->scheduler = CODEX_SCHED_EDF;
	else
		return (0);
	return (1);
}

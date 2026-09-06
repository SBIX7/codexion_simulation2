#include "codexion.h"

int	main(int argc, char **argv)
{
	t_simulation	sim;

	memset(&sim, 0, sizeof(sim));
	if (!parse_args(&sim, argc, argv))
	{
		fprintf(stderr, "Error: invalid arguments\n");
		return (1);
	}
	if (!init_simulation(&sim))
	{
		fprintf(stderr, "Error: initialization failed\n");
		cleanup_simulation(&sim);
		return (1);
	}
	if (!run_simulation(&sim))
	{
		fprintf(stderr, "Error: simulation failed\n");
		cleanup_simulation(&sim);
		return (1);
	}
	cleanup_simulation(&sim);
	return (0);
}

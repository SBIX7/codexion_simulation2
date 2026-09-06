*This project has been created as part of the 42 curriculum by @SBIX7*

# Codexion

Codexion is a concurrency simulation in C where multiple coder threads compete for shared USB dongles.

## Build

```bash
make
```

## Run

```bash
./codexion number_of_coders time_to_burnout time_to_compile time_to_debug time_to_refactor number_of_compiles_required dongle_cooldown scheduler
```

Example:

```bash
./codexion 5 800 200 200 200 3 50 edf
```

## Logging format

The program prints serialized state transitions:

- `timestamp coder_id has taken a dongle`
- `timestamp coder_id is compiling`
- `timestamp coder_id is debugging`
- `timestamp coder_id is refactoring`
- `timestamp coder_id burned out`

## Scheduler policies

- `fifo`: requests are served in arrival order.
- `edf`: requests are served by earliest burnout deadline first (`last_compile_start + time_to_burnout`).

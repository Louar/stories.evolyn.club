#!/usr/bin/env bash

set -Eeuo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
    exec /usr/bin/env bash "$0" "$@"
fi

# Always run from the repository root, even when invoked elsewhere.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "$REPOSITORY_ROOT"

if [[ -t 1 ]]; then
	BOLD=$'\033[1m'
	DIM=$'\033[2m'
	RED=$'\033[31m'
	GREEN=$'\033[32m'
	YELLOW=$'\033[33m'
	BLUE=$'\033[34m'
	CYAN=$'\033[36m'
	RESET=$'\033[0m'
else
	BOLD=""
	DIM=""
	RED=""
	GREEN=""
	YELLOW=""
	BLUE=""
	CYAN=""
	RESET=""
fi

print_header() {
	printf '%s%s\n' "$BOLD$CYAN" "Docker image configuration"
	printf '%s\n\n' "${DIM}Configure, build, and publish a Docker image.${RESET}"
}

print_step() {
	printf '%s%s%s %s\n' "$BOLD$BLUE" "==>" "$RESET" "$1"
}

print_success() {
	printf '%s%s%s %s\n' "$BOLD$GREEN" "✓" "$RESET" "$1"
}

print_error() {
	printf '%s%s%s %s\n' "$BOLD$RED" "✗" "$RESET" "$1" >&2
}

ensure_buildx_builder() {
	local builder_name="publish-image-builder"
	local current_driver

	current_driver="$(docker buildx inspect "$builder_name" --format '{{.Driver}}' 2>/dev/null || true)"

	if [[ "$current_driver" == "docker-container" ]]; then
		docker buildx inspect "$builder_name" --bootstrap >/dev/null
		printf '%s' "$builder_name"
		return 0
	fi

	print_step "Creating buildx builder ${CYAN}${builder_name}${RESET} for registry cache support..." >&2

	# Remove any stale or incompatible builder with the same name before creating
	# it. `buildx inspect` can fail to return a driver while the instance still
	# exists, and `buildx create --name` would then fail with a duplicate name.
	docker buildx rm "$builder_name" >/dev/null 2>&1 || true

	docker buildx create --name "$builder_name" --driver docker-container >/dev/null
	docker buildx inspect "$builder_name" --bootstrap >/dev/null
	printf '%s' "$builder_name"
}

get_env_default() {
	local variable_name="$1"
	local env_file="${REPOSITORY_ROOT}/.env"

	if [[ ! -f "$env_file" ]]; then
		return 0
	fi

	while IFS= read -r line || [[ -n "$line" ]]; do
		line="${line#export }"

		if [[ "$line" =~ ^[[:space:]]*${variable_name}= ]]; then
			local value="${line#*=}"

			value="${value%%#*}"
			value="${value%"${value##*[![:space:]]}"}"
			value="${value#"${value%%[![:space:]]*}"}"
			value="${value%\"}"
			value="${value#\"}"
			value="${value%\'}"
			value="${value#\'}"

			printf '%s' "$value"
			return 0
		fi
	done <"$env_file"
}

PACKAGE_NAME="$(node -p "require('./package.json').name")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"

# Environment variables and the first argument become the prompt defaults,
# falling back to .env values when the shell environment is not set.
IMAGE_NAME="${IMAGE_NAME:-$PACKAGE_NAME}"
VERSION="${1:-${VERSION:-latest}}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-$(get_env_default DOCKER_REGISTRY)}"
DOCKER_USERNAME="${DOCKER_USERNAME:-$(get_env_default DOCKER_USERNAME)}"
DOCKER_PASSWORD="${DOCKER_PASSWORD:-$(get_env_default DOCKER_PASSWORD)}"

prompt_with_default() {
	local label="$1"
	local default_value="$2"
	local input

	read -r -p "${BOLD}${label}${RESET} ${DIM}[${default_value}]${RESET}: " input
	printf '%s' "${input:-$default_value}"
}

select_option() {
	local options=("$@")
	local selected_index=0
	local key

	if [[ ${#options[@]} -eq 0 ]]; then
		return 1
	fi

	printf '%s\n' "${BOLD}Image version${RESET} ${DIM}(Use arrow keys, Enter to confirm)${RESET}" >&2

	while true; do
		for index in "${!options[@]}"; do
			if [[ $index -eq $selected_index ]]; then
				printf '  %s› %s%s\n' "$GREEN$BOLD" "${options[$index]}" "$RESET" >&2
			else
				printf '    %s\n' "${options[$index]}" >&2
			fi
		done

		IFS= read -rsn1 key

		case "$key" in
			'')
				printf '%s' "${options[$selected_index]}"
				return 0
				;;
			$'\x1b')
				IFS= read -rsn2 key || true

				case "$key" in
					'[A')
						selected_index=$(((selected_index + ${#options[@]} - 1) % ${#options[@]}))
						;;
					'[B')
						selected_index=$(((selected_index + 1) % ${#options[@]}))
						;;
				esac
				;;
		esac

		printf '\033[%sA' "${#options[@]}" >&2
	done
}

prompt_version() {
	local versions=("latest" "$PACKAGE_VERSION")
	local ordered_versions
	local selected_index=0

	if [[ "$VERSION" == "$PACKAGE_VERSION" ]]; then
		selected_index=1
	fi

	ordered_versions=("${versions[$selected_index]}")
	for index in "${!versions[@]}"; do
		if [[ $index -ne $selected_index ]]; then
			ordered_versions+=("${versions[$index]}")
		fi
	done

	select_option "${ordered_versions[@]}"
}

if [[ -t 0 ]]; then
	print_header

	IMAGE_NAME="$(prompt_with_default "Image name" "$IMAGE_NAME")"
	VERSION="$(prompt_version)"
	DOCKER_REGISTRY="$(prompt_with_default "Registry host" "$DOCKER_REGISTRY")"
	DOCKER_USERNAME="$(prompt_with_default "Registry username" "$DOCKER_USERNAME")"

	if [[ -n "$DOCKER_PASSWORD" ]]; then
		read -r -s \
			-p "${BOLD}Registry password${RESET} ${DIM}[press Enter to keep existing value]${RESET}: " \
			password_input
		echo

		DOCKER_PASSWORD="${password_input:-$DOCKER_PASSWORD}"
	else
		while [[ -z "$DOCKER_PASSWORD" ]]; do
			read -r -s -p "${BOLD}Registry password${RESET}: " DOCKER_PASSWORD
			echo

			if [[ -z "$DOCKER_PASSWORD" ]]; then
				print_error "A registry password is required."
			fi
		done
	fi

	echo
else
	# In CI/CD there is no interactive terminal, so credentials must be
	# supplied through environment variables.
	: "${DOCKER_PASSWORD:?DOCKER_PASSWORD must be set in non-interactive mode}"
fi

# Remove accidental surrounding slashes.
DOCKER_REGISTRY="${DOCKER_REGISTRY%/}"
IMAGE_NAME="${IMAGE_NAME#/}"

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY must not be empty}"
: "${IMAGE_NAME:?IMAGE_NAME must not be empty}"
: "${VERSION:?VERSION must not be empty}"
: "${DOCKER_USERNAME:?DOCKER_USERNAME must not be empty}"
: "${DOCKER_PASSWORD:?DOCKER_PASSWORD must not be empty}"

if [[ "$VERSION" != "latest" && "$VERSION" != "$PACKAGE_VERSION" ]]; then
	print_error "VERSION must be 'latest' or '${PACKAGE_VERSION}'."
	exit 1
fi

FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}:${VERSION}"
CACHE_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}:buildcache-linux-amd64"

print_step "Logging in to ${CYAN}${DOCKER_REGISTRY}${RESET}..."

printf '%s' "$DOCKER_PASSWORD" |
	docker login "$DOCKER_REGISTRY" \
		--username "$DOCKER_USERNAME" \
		--password-stdin

# The password is no longer needed after login.
unset DOCKER_PASSWORD

echo
print_step "Building and publishing ${CYAN}${FULL_IMAGE_NAME}${RESET} for ${CYAN}linux/amd64${RESET}..."

BUILDX_BUILDER="$(ensure_buildx_builder)"

docker buildx build \
	--builder "$BUILDX_BUILDER" \
	--platform linux/amd64 \
	--tag "$FULL_IMAGE_NAME" \
	--cache-from "type=registry,ref=$CACHE_IMAGE_NAME" \
	--cache-to "type=registry,ref=$CACHE_IMAGE_NAME,mode=max" \
	--push \
	.

echo
print_success "Published ${CYAN}${FULL_IMAGE_NAME}${RESET}"

import type { CheatsheetTopic } from "./types";

export const docker: CheatsheetTopic = {
  id: "docker",
  name: "Docker",
  categories: [
    {
      name: "Containers",
      items: [
        { command: "docker run <image>", description: "Run a container" },
        { command: "docker run -d -p 8080:80 <image>", description: "Run detached with port mapping" },
        { command: "docker run -it <image> /bin/sh", description: "Run interactive shell" },
        { command: "docker ps", description: "List running containers" },
        { command: "docker ps -a", description: "List all containers" },
        { command: "docker stop <container>", description: "Stop container" },
        { command: "docker start <container>", description: "Start stopped container" },
        { command: "docker restart <container>", description: "Restart container" },
        { command: "docker rm <container>", description: "Remove container" },
        { command: "docker logs <container>", description: "View container logs" },
        { command: "docker logs -f <container>", description: "Follow container logs" },
        { command: "docker exec -it <container> /bin/sh", description: "Shell into running container" },
        { command: "docker inspect <container>", description: "Container details as JSON" },
      ],
    },
    {
      name: "Images",
      items: [
        { command: "docker images", description: "List local images" },
        { command: "docker pull <image>", description: "Pull image from registry" },
        { command: "docker build -t <name> .", description: "Build image from Dockerfile" },
        { command: "docker rmi <image>", description: "Remove image" },
        { command: "docker tag <src> <dest>", description: "Tag image" },
        { command: "docker push <image>", description: "Push image to registry" },
        { command: "docker image prune", description: "Remove dangling images" },
      ],
    },
    {
      name: "Volumes & Networks",
      items: [
        { command: "docker volume ls", description: "List volumes" },
        { command: "docker volume create <name>", description: "Create volume" },
        { command: "docker volume rm <name>", description: "Remove volume" },
        { command: "docker network ls", description: "List networks" },
        { command: "docker network create <name>", description: "Create network" },
        { command: "docker network connect <net> <ctr>", description: "Connect container to network" },
      ],
    },
    {
      name: "Compose",
      items: [
        { command: "docker compose up", description: "Start services" },
        { command: "docker compose up -d", description: "Start services in background" },
        { command: "docker compose down", description: "Stop and remove services" },
        { command: "docker compose build", description: "Build or rebuild services" },
        { command: "docker compose logs -f", description: "Follow service logs" },
        { command: "docker compose ps", description: "List running services" },
        { command: "docker compose exec <svc> sh", description: "Shell into service" },
      ],
    },
    {
      name: "System",
      items: [
        { command: "docker system df", description: "Show disk usage" },
        { command: "docker system prune", description: "Remove unused data" },
        { command: "docker stats", description: "Live container resource usage" },
      ],
    },
  ],
};

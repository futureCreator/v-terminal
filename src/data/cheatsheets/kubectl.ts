import type { CheatsheetTopic } from "./types";

export const kubectl: CheatsheetTopic = {
  id: "kubectl",
  name: "kubectl",
  categories: [
    {
      name: "Cluster & Context",
      items: [
        { command: "kubectl cluster-info", description: "Display cluster info" },
        { command: "kubectl config get-contexts", description: "List contexts" },
        { command: "kubectl config use-context <ctx>", description: "Switch context" },
        { command: "kubectl config current-context", description: "Show current context" },
        { command: "kubectl get namespaces", description: "List namespaces" },
      ],
    },
    {
      name: "Pods",
      items: [
        { command: "kubectl get pods", description: "List pods in current namespace" },
        { command: "kubectl get pods -A", description: "List pods in all namespaces" },
        { command: "kubectl get pods -o wide", description: "List pods with node info" },
        { command: "kubectl describe pod <name>", description: "Detailed pod info" },
        { command: "kubectl logs <pod>", description: "View pod logs" },
        { command: "kubectl logs -f <pod>", description: "Follow pod logs" },
        { command: "kubectl logs <pod> -c <container>", description: "Logs from specific container" },
        { command: "kubectl exec -it <pod> -- /bin/sh", description: "Shell into pod" },
        { command: "kubectl delete pod <name>", description: "Delete pod" },
        { command: "kubectl top pods", description: "Pod resource usage" },
      ],
    },
    {
      name: "Deployments",
      items: [
        { command: "kubectl get deployments", description: "List deployments" },
        { command: "kubectl describe deployment <name>", description: "Deployment details" },
        { command: "kubectl scale deployment <name> --replicas=<n>", description: "Scale deployment" },
        { command: "kubectl rollout status deployment <name>", description: "Rollout status" },
        { command: "kubectl rollout restart deployment <name>", description: "Rolling restart" },
        { command: "kubectl rollout undo deployment <name>", description: "Rollback deployment" },
        { command: "kubectl set image deployment/<name> <c>=<img>", description: "Update container image" },
      ],
    },
    {
      name: "Services & Networking",
      items: [
        { command: "kubectl get services", description: "List services" },
        { command: "kubectl get ingress", description: "List ingress rules" },
        { command: "kubectl expose deployment <name> --port=<p>", description: "Expose deployment" },
        { command: "kubectl port-forward <pod> <local>:<remote>", description: "Port forward to pod" },
        { command: "kubectl port-forward svc/<svc> <local>:<remote>", description: "Port forward to service" },
      ],
    },
    {
      name: "Config & Secrets",
      items: [
        { command: "kubectl get configmaps", description: "List ConfigMaps" },
        { command: "kubectl get secrets", description: "List secrets" },
        { command: "kubectl create secret generic <name> --from-literal=<k>=<v>", description: "Create secret" },
        { command: "kubectl get secret <name> -o jsonpath='{.data}'", description: "View secret data" },
      ],
    },
    {
      name: "Apply & Delete",
      items: [
        { command: "kubectl apply -f <file.yaml>", description: "Apply manifest" },
        { command: "kubectl apply -f <dir>/", description: "Apply all manifests in dir" },
        { command: "kubectl delete -f <file.yaml>", description: "Delete resources from manifest" },
        { command: "kubectl delete <resource> <name>", description: "Delete specific resource" },
        { command: "kubectl get all", description: "List all resources" },
        { command: "kubectl api-resources", description: "List available resource types" },
      ],
    },
  ],
};

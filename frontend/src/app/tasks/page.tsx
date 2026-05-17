import { TaskList } from "@/components/tasks/TaskList";

export default function TasksPage() {
  return (
    <div className="container max-w-screen-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Browse Tasks</h1>
      <TaskList />
    </div>
  );
}

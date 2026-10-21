/**
 * Kafka RangeAssignor implementation.
 * Partitions are divided evenly across consumers in alphabetical order.
 * Any remainder is allocated one each to the first consumers.
 */
export function rangeAssign(numConsumers: number, numPartitions: number): number[][] {
  if (numConsumers <= 0) return [];
  const base = Math.floor(numPartitions / numConsumers);
  const extra = numPartitions % numConsumers;
  const assignment: number[][] = [];
  let currentPartition = 0;

  for (let i = 0; i < numConsumers; i++) {
    const count = base + (i < extra ? 1 : 0);
    const consumerParts: number[] = [];
    for (let j = 0; j < count; j++) {
      consumerParts.push(currentPartition++);
    }
    assignment.push(consumerParts);
  }

  return assignment;
}

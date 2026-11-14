// Instrumented sorting algorithms.
//
// Each algorithm is a generator that sorts `a` in place and yields one
// operation every time it reads-and-compares or writes:
//
//   { type: "compare", i, j }     compared a[i] with a[j]
//   { type: "swap", i, j }        swapped a[i] and a[j]
//   { type: "write", i, value }   a[i] = value (merge sort copies from a buffer)
//
// The UI replays these operations to animate the sort, and the race engine
// counts them. Because the generator mutates the array itself, the yielded
// operations must describe exactly what happened; tests replay them on a
// copy to prove it.

function* compare(a, i, j, out) {
  yield { type: "compare", i, j };
  out.result = a[i] - a[j];
}

function* swap(a, i, j) {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
  yield { type: "swap", i, j };
}

export function* bubbleSort(a) {
  const c = {};
  for (let end = a.length - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      yield* compare(a, i, i + 1, c);
      if (c.result > 0) {
        yield* swap(a, i, i + 1);
        swapped = true;
      }
    }
    if (!swapped) return; // already sorted: stop early
  }
}

export function* insertionSort(a) {
  const c = {};
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0; j--) {
      yield* compare(a, j - 1, j, c);
      if (c.result <= 0) break;
      yield* swap(a, j - 1, j);
    }
  }
}

export function* selectionSort(a) {
  const c = {};
  for (let i = 0; i < a.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) {
      yield* compare(a, j, min, c);
      if (c.result < 0) min = j;
    }
    if (min !== i) yield* swap(a, i, min);
  }
}

// Top-down merge sort. Comparisons read from a copy of the run being
// merged, so "compare" reports the original positions in `a`.
export function* mergeSort(a) {
  yield* mergeRange(a, 0, a.length);
}

function* mergeRange(a, lo, hi) {
  if (hi - lo < 2) return;
  const mid = (lo + hi) >>> 1;
  yield* mergeRange(a, lo, mid);
  yield* mergeRange(a, mid, hi);
  const left = a.slice(lo, mid);
  const right = a.slice(mid, hi);
  let i = 0, j = 0, k = lo;
  while (i < left.length && j < right.length) {
    // left[i] lives at lo + i only until it is overwritten; report the
    // write position and the right element's original position.
    yield { type: "compare", i: k, j: mid + j };
    if (left[i] <= right[j]) {       // <= keeps equal elements in order (stable)
      a[k] = left[i++];
    } else {
      a[k] = right[j++];
    }
    yield { type: "write", i: k, value: a[k] };
    k++;
  }
  while (i < left.length) {
    a[k] = left[i++];
    yield { type: "write", i: k, value: a[k] };
    k++;
  }
  // Remaining right elements are already in place.
}

// Quicksort: Hoare partition with a median-of-three pivot, so sorted and
// reversed inputs do not trigger the O(n^2) worst case.
export function* quickSort(a) {
  yield* quickRange(a, 0, a.length - 1);
}

function* quickRange(a, lo, hi) {
  const c = {};
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    // order a[lo], a[mid], a[hi] so the median ends up at mid
    yield* compare(a, mid, lo, c);
    if (c.result < 0) yield* swap(a, mid, lo);
    yield* compare(a, hi, lo, c);
    if (c.result < 0) yield* swap(a, hi, lo);
    yield* compare(a, hi, mid, c);
    if (c.result < 0) yield* swap(a, hi, mid);
    const pivot = a[mid];

    let i = lo - 1, j = hi + 1;
    for (;;) {
      do {
        i++;
        yield { type: "compare", i, j: mid };
      } while (a[i] < pivot);
      do {
        j--;
        yield { type: "compare", i: j, j: mid };
      } while (a[j] > pivot);
      if (i >= j) break;
      yield* swap(a, i, j);
    }
    // Recurse into the smaller side, loop on the larger: O(log n) stack.
    if (j - lo < hi - j) {
      yield* quickRange(a, lo, j);
      lo = j + 1;
    } else {
      yield* quickRange(a, j + 1, hi);
      hi = j;
    }
  }
}

export function* heapSort(a) {
  const n = a.length;
  for (let i = (n >>> 1) - 1; i >= 0; i--) yield* siftDown(a, i, n);
  for (let end = n - 1; end > 0; end--) {
    yield* swap(a, 0, end);
    yield* siftDown(a, 0, end);
  }
}

function* siftDown(a, root, n) {
  const c = {};
  for (;;) {
    const left = 2 * root + 1;
    if (left >= n) return;
    let child = left;
    if (left + 1 < n) {
      yield* compare(a, left + 1, left, c);
      if (c.result > 0) child = left + 1;
    }
    yield* compare(a, child, root, c);
    if (c.result <= 0) return;
    yield* swap(a, root, child);
    root = child;
  }
}

export const ALGORITHMS = {
  bubble: { name: "Bubble sort", run: bubbleSort, complexity: "O(n²)" },
  insertion: { name: "Insertion sort", run: insertionSort, complexity: "O(n²)" },
  selection: { name: "Selection sort", run: selectionSort, complexity: "O(n²)" },
  merge: { name: "Merge sort", run: mergeSort, complexity: "O(n log n)" },
  quick: { name: "Quicksort", run: quickSort, complexity: "O(n log n) avg" },
  heap: { name: "Heap sort", run: heapSort, complexity: "O(n log n)" },
};

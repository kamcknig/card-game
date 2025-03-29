export const getOrderStartingFrom = <T>(arr: T[], val: T): T[] => {
    let results: T[] = [];
    const startIndex = arr.indexOf(val);
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        const idx = (startIndex + i) % len;
        results.push(arr[idx]);
    }
    return results;
}

export const getExpansionList = async () => {
    const expansionList: any[] = (await import(`../expansions/expansion-list.json`, {with: {type: 'json'}})).default;
    return expansionList;
}

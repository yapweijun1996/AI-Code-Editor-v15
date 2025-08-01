/**
 * Search engine integration tools
 */

export async function _duckduckgoSearch({ query }) {
    const response = await fetch('/api/duckduckgo-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    const searchResult = await response.json();
    if (response.ok) {
        return searchResult;
    } else {
        throw new Error(searchResult.message || 'Failed to perform search');
    }
}
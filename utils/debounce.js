function debounce(fn, wait) {
    let timeoutId = null;
    return function(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        const context = this;
        timeoutId = setTimeout(() => fn.apply(context, args), wait);
    };
}



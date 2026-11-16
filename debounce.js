export function debounce(fn, delay) {
    let timer;
    const debounced = ((...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            fn(...args);
        }, delay);
    });
    debounced.cancel = () => {
        clearTimeout(timer);
        timer = undefined;
    };
    return debounced;
}

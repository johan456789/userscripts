function retry(fn, maxRetries = 5, delay = 100, logger = null) {
    if (!logger || typeof logger !== 'function') {
        logger = console.log;
    }

    let retryCount = 0;
    
    function attempt() {
        const result = fn();
        
        if (result === true) {
            return true; // Success
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
            logger(`Retry ${retryCount}/${maxRetries} in ${delay}ms...`);
            setTimeout(attempt, delay);
        } else {
            logger(`Failed after ${maxRetries} attempts.`);
            return false;
        }
    }
    
    return attempt();
}
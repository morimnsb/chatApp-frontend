import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const useFetch = (url, config) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Using useMemo to memoize the config object
  const memoizedConfig = useMemo(() => config, [config]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(url, memoizedConfig);
        setData(response.data);
      } catch (error) {
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, memoizedConfig]); // Memoized config is included as a dependency

  return { data, loading, error };
};

export default useFetch;

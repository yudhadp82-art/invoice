export default {
  server: {
    proxy: {
      '/tgapi': {
        target: 'https://api.telegram.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tgapi/, ''),
      },
    },
  },
};

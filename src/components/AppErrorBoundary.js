import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return React.createElement(
        'div',
        { style: { padding: 16, color: 'crimson' } },
        'اوه! مشکلی در برنامه رخ داد. لطفاً صفحه را رفرش کنید.',
      );
    }
    return this.props.children;
  }
}

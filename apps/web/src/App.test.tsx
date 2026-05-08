import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';
import App from '@/App';

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    );

    const loanLensElements = screen.getAllByText(/LoanLens/i);
    expect(loanLensElements.length).toBeGreaterThan(0);
  });

  it('renders navigation items', () => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Documents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Borrowers').length).toBeGreaterThan(0);
  });
});

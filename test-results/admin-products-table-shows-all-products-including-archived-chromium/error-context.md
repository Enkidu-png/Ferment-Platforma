# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - link "FERMENT" [ref=e6] [cursor=pointer]:
        - /url: /
      - link "Sign up" [ref=e7] [cursor=pointer]:
        - /url: /sign-up
    - heading "Welcome back to FERMENT." [level=1] [ref=e8]
    - generic [ref=e9]:
      - generic [ref=e10]: Email
      - textbox "Email" [ref=e11]: admin@ferment.com
    - generic [ref=e12]:
      - generic [ref=e13]: Password
      - textbox "Password" [ref=e14]: Ferm3nt!Admin
    - button "Log in" [disabled]
  - region "Notifications alt+T"
  - alert [ref=e16]
```
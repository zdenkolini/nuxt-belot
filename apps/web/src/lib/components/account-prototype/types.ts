// PROTOTYPE: props shared by the account, username, and claim variants.
export type Screen = 'account' | 'username' | 'claim';
export type Choice = 'kept_account' | 'merged';

export type VariantProps = {
	screen: Screen;
	me: { username: string | null; email: string; isGuest: boolean } | null;
	matches: number | null;
	claim: { guestMatches: number; accountMatches: number } | null;
	choosing: boolean;
	chooseFailed: boolean;
	onchoose: (choice: Choice) => void;
};

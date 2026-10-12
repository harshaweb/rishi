export const rentalFail = (status: number, message: string) => Object.assign(new Error(message), { status })

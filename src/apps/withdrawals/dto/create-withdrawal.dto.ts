import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateWithdrawalDto {
    @ApiProperty({
        description: 'Amount to withdraw',
        example: 100.00,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(1, { message: 'Minimum withdrawal amount is $1.00' })
    amount: number;

    @ApiProperty({
        description: 'Payout account (e.g., PayPal email or IBAN)',
        example: 'artist@example.com',
    })
    @IsNotEmpty()
    @IsString()
    payoutAccount: string;
}

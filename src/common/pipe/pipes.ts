import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class ReqParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException("The parameter is required.");
    }
    return value;
  }
}

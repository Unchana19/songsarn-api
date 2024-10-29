import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './providers/users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { GetUserParamDto } from './dtos/get-user-param.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateAddressDto } from './dtos/update-address.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseInterceptors(ClassSerializerInterceptor)
  @Auth(AuthType.None)
  public createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get('/:id')
  @Auth(AuthType.None)
  public findUserById(@Param() getUserParamDto: GetUserParamDto) {
    return this.usersService.getUserInfoById(getUserParamDto);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file'))
  public updateProfileById(
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateUserById(updateProfileDto, file);
  }

  @Patch('address')
  public updateAddressById(@Body() updateAddressDto: UpdateAddressDto) {
    return this.usersService.updateAddressById(updateAddressDto);
  }
}
